import { default as puppeteer } from 'puppeteer';
import { prompt } from 'inquirer';
import { SELECTOR } from './SELECTOR';
import { promises } from 'fs-extra';

const ACCOUNTS_TO_SKIP = [
    9872250,
    9872251,
];

export interface Account {
    id: number;
    provider: string;
    name: string;
    lastDigits?: string;
}

export interface Transaction {
    date: import('luxon').DateTime;
    description: string;
    amount: number;
    account: Account;
}

async function debugScreenshot(page: puppeteer.Page) {
    if (process.env.DEBUG_SCREENSHOTS) await page.screenshot({
        path: 'debug.png'
    });
}

async function downloadRequewst(req: puppeteer.Request) {
    console.dir(req);
}

export async function pullAllTransactions(email: string): Promise<Transaction[]> {
    console.log('Initializing browser...');
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: {
            width: 1920,
            height: 1080
        },
    });
    const page = await browser.newPage();
    try {
        console.log('Navigating to Mint...');
        await page.goto('https://mint.com');
        await debugScreenshot(page);
        console.log('Signing in...');
        await page.click(SELECTOR.ROOT.SIGN_IN);
        await debugScreenshot(page);
        await page.waitForSelector(SELECTOR.SIGN_IN.EMAIL);
        await page.type(SELECTOR.SIGN_IN.EMAIL, email);
        await debugScreenshot(page);
        const passwd = (await prompt([{
            message: `Password for ${email}?`,
            type: 'password',
            name: 'passwd'
        }])).passwd;
        await page.type(SELECTOR.SIGN_IN.PASSWORD, passwd);
        await debugScreenshot(page);
        await page.click(SELECTOR.SIGN_IN.SUBMIT);
        await debugScreenshot(page);
        const needMfa = await Promise.race([
            page.waitForSelector(SELECTOR.DASHBOARD.NAV.TRANSACTIONS).then(() => false),
            page.waitForSelector(SELECTOR.MFA.START_BUTTON).then(() => true),
        ]);
        await debugScreenshot(page);

        if (needMfa) {
            console.log('Starting 2fa...');
            await page.click(SELECTOR.MFA.START_BUTTON);
            const mfa = (await prompt([{
                message: '2fa?',
                type: 'number',
                name: 'mfa'
            }])).mfa;
            await debugScreenshot(page);
            await page.waitForSelector(SELECTOR.MFA.INPUT);
            await page.type(SELECTOR.MFA.INPUT, `${mfa}`);
            await debugScreenshot(page);
            await page.click(SELECTOR.MFA.SUBMIT);
            await debugScreenshot(page);
            await page.waitForSelector(SELECTOR.DASHBOARD.NAV.TRANSACTIONS);
            await debugScreenshot(page);
        }

        console.log('Opening transactions...');

        await page.click(SELECTOR.DASHBOARD.NAV.TRANSACTIONS);
        await page.click(SELECTOR.DASHBOARD.NAV.TRANSACTIONS);
        await debugScreenshot(page);
        const SEL = SELECTOR.DASHBOARD.TRANSACTIONS;
        await page.waitForSelector(SEL.ACCOUNT_NAV.ALL_ACCOUNTS);
        const accounts = await page.evaluate(selector => {
            return Array.from(document.querySelectorAll(selector))
                .map((x: HTMLElement) => {
                    const subtitle = (Array.from(x.children).find(c => c.tagName === 'SMALL') as HTMLElement).innerText;
                    const parse = /(.*)\(\.\.\.(.*)\)$/.exec(subtitle.trim());
                    return {
                        id: Number(x.id.substr(8).trim()),
                        provider: (Array.from(x.children).find(c => c.tagName === 'A') as HTMLElement).innerText.trim(),
                        name: parse ? parse[1].trim() : subtitle.trim(),
                        lastDigits: parse ? parse[2].trim() : undefined,
                    };
                })
                .filter(x => x.id !== 0);
        }, SEL.ACCOUNT_NAV.ANY_ACCOUNT);

        const transactions: Transaction[] = [];

        try {
            await page.waitForSelector(SEL.MODAL_CLOSE, { timeout: 1000 });
            await debugScreenshot(page);
            console.log('Closing modal...');
            await page.click(SEL.MODAL_CLOSE);
            await debugScreenshot(page);
        } catch (e) { }

        for (const account of accounts) {
            if (ACCOUNTS_TO_SKIP.includes(account.id)) continue;

            console.dir(account);
            await page.evaluate(() => {
                // Sometimes the edit bar glitches to the left and gets in the way.
                // Lets just kill it if it exists.
                const editBar = document.getElementById('txnEdit-basic');
                if (editBar) editBar.style.display = 'none';
            });
            await page.waitForSelector(SEL.ACCOUNT_NAV.ACCOUNT(account.id));
            await page.click(SEL.ACCOUNT_NAV.ACCOUNT(account.id));
            await debugScreenshot(page);

            try {
                await page.waitForFunction(
                    (selector, goal) => {
                        const result = document.querySelector(selector);
                        if (!result) return false;
                        return result.innerText.trim() === goal;
                    },
                    { timeout: 10000 },
                    SEL.TRANSACTION_DETAILS.ACCOUNT,
                    `${account.provider} - ${account.name}`
                );
            } catch (e) {
                const noTrx = await page.evaluate(() => {
                    return document.getElementById('body-container')?.className.includes('no_txn');
                });
                if (noTrx) {
                    console.log(`${account.provider} - ${account.name} does not have any transactions.`);
                } else {
                    throw e;
                }
            }

            await debugScreenshot(page);

            const requestPromise = new Promise<puppeteer.Request>(resolve => {
                page.once('request', interceptedRequest => {
                    if (!interceptedRequest.url().includes('transactionDownload')) {
                        interceptedRequest.continue();
                        return;
                    }
                    interceptedRequest.abort(); // stop intercepting requests
                    resolve(interceptedRequest);
                });
            });

            await page.setRequestInterception(true);

            await page.evaluate(
                selector => document.querySelector(selector).click(),
                SEL.TRANSACTION_DETAILS.DOWNLOAD_CSV);

            await downloadRequewst(await requestPromise);
            await debugScreenshot(page);
        }

        await page.screenshot({
            path: './result.png'
        });
        await browser.close();

        return transactions;
    } catch (e) {
        await debugScreenshot(page);
        await page.screenshot({
            path: './error.png'
        });
        throw e;
    }
}
