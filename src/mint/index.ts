import { default as puppeteer } from 'puppeteer';
import { prompt } from 'inquirer';
import { SELECTOR } from './SELECTOR';
import { get } from 'needle';
import { default as csvparse } from 'csv-parse';
import { DateTime } from 'luxon';
import { SingleBar as CliProgressBar, Presets as CliProgressPresets } from 'cli-progress';
import { default as chalk } from 'chalk';

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

async function promptPassword(email: string): Promise<string> {
    const password = await prompt([{
        message: `Password for ${email}?`,
        type: 'password',
        name: 'passwd'
    }]).then(obj => obj.passwd);

    if (password.length <= 6 || password.includes(' ')) {
        console.log(chalk.red('Use 6 or more characters and no spaces.'));
        return await promptPassword(email);
    } else {
        return password;
    }
}

export async function pullAllTransactions(email: string): Promise<Transaction[]> {
    const passwordPromise = promptPassword(email);

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: {
            width: 1920,
            height: 1080
        },
    });
    const page = await browser.newPage();
    try {
        await page.goto('https://mint.com');
        await page.click(SELECTOR.ROOT.SIGN_IN);
        await page.waitForSelector(SELECTOR.SIGN_IN.EMAIL);
        await page.type(SELECTOR.SIGN_IN.EMAIL, email);
        await page.type(SELECTOR.SIGN_IN.PASSWORD, await passwordPromise);
        await page.click(SELECTOR.SIGN_IN.SUBMIT);
        const needMfa = await Promise.race([
            page.waitForSelector(SELECTOR.DASHBOARD.NAV.TRANSACTIONS).then(() => false),
            page.waitForSelector(SELECTOR.MFA.START_BUTTON).then(() => true),
        ]);

        if (needMfa) {
            await page.click(SELECTOR.MFA.START_BUTTON);
            const mfa = (await prompt([{
                message: '2fa?',
                type: 'number',
                name: 'mfa'
            }])).mfa;
            await page.waitForSelector(SELECTOR.MFA.INPUT);
            await page.type(SELECTOR.MFA.INPUT, `${mfa}`);
            await page.click(SELECTOR.MFA.SUBMIT);
            await page.waitForSelector(SELECTOR.DASHBOARD.NAV.TRANSACTIONS);
        }

        await page.waitForSelector(SELECTOR.DASHBOARD.NAV.TRANSACTIONS);

        while (await page.evaluate(sel => {
            return !(document.querySelector(sel).className.split(' ').includes('selected'));
        }, SELECTOR.DASHBOARD.NAV.TRANSACTIONS)) {
            await page.click(SELECTOR.DASHBOARD.NAV.TRANSACTIONS);
        }

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

        const cookies = Object.fromEntries((await page.cookies()).map(x => [x.name, x.value]));

        await browser.close();

        const transactions: Transaction[] = [];

        const cli = new CliProgressBar({}, CliProgressPresets.shades_classic);
        cli.start(accounts.length, 0);

        try {
            await Promise.all(accounts.map(account => (async () => {
                const parser = get(`https://mint.intuit.com/transactionDownload.event?accountId=${account.id}&queryNew=&offset=0&comparableType=8`, { cookies: cookies })
                    .pipe(csvparse({
                        bom: true,
                        columns: true,
                    }));

                for await (const record of parser) {
                    const transaction: Transaction = {
                        date: DateTime.fromFormat(record['Date'], 'M/dd/yyyy'),
                        description: record['Original Description'],
                        amount: Number(record['Amount']) * (record['Transaction Type'] === 'credit' ? 1 : -1),
                        account: account
                    };

                    if (!['credit', 'debit'].includes(record['Transaction Type'])) throw new Error(`Unknown "Transaction Type": ${JSON.stringify(record['Transaction Type'])}`);
                    if (!transaction.date.isValid) throw new Error(`Unparseable date: ${JSON.stringify(record['Date'])}`);
                    if (undefined === transaction.description) throw new Error(`Missing column "Original Description". Available columns are: ${JSON.stringify(Object.keys(record))}`);
                    if (isNaN(transaction.amount)) throw new Error(`Unparseable amount: ${JSON.stringify(record['Amount'])}`);

                    transactions.push(transaction);
                }

                cli.increment();
            })()));
        } finally {
            cli.stop();
        }

        return transactions;
    } catch (e) {
        try {
            await page.screenshot({ path: 'error.png' })
            await page.close();
        } catch(_) {}

        throw e;
    }
}
