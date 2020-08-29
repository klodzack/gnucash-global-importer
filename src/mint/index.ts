import { default as puppeteer } from 'puppeteer';
import { prompt } from 'inquirer';
import { SELECTOR } from './SELECTOR';
import { get } from 'needle';
import { default as csvparse } from 'csv-parse';
import { DateTime } from 'luxon';
import { SingleBar as CliProgressBar, Presets as CliProgressPresets } from 'cli-progress';
import { default as chalk } from 'chalk';
import { MultiLineCli } from './MultiLineCli';
import { HideableMultiLineCli } from './HideableMultiLineCli';
import { RunOptions, Account, Transaction } from '../types';

async function promptPassword(email?: string): Promise<string> {
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

export async function pullAllTransactions(options: RunOptions): Promise<Transaction[]> {
    const cli = new HideableMultiLineCli([]);
    const passwordPromise: Promise<string> = options.password ? new Promise(r => r(options.password)) : promptPassword(options.email);
    passwordPromise.then(() => cli.unhide());

    cli.updateAll(['Initializing Browser...']);
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: {
            width: 1920,
            height: 1080
        },
    });
    const page = await browser.newPage();
    try {
        cli.updateAll(['Opening mint.com...']);
        await page.goto('https://mint.com');
        cli.updateAll(['Clicking signin button...']);
        await page.click(SELECTOR.ROOT.SIGN_IN);
        cli.updateAll(['Waiting for sign-in page to load...']);
        await page.waitForSelector(SELECTOR.SIGN_IN.EMAIL);
        cli.updateAll(['Typing email address...']);
        await page.type(SELECTOR.SIGN_IN.EMAIL, options.email);
        cli.updateAll(['Typing password...']);
        await page.type(SELECTOR.SIGN_IN.PASSWORD, await passwordPromise);
        cli.updateAll(['Clicking submit...']);
        await page.click(SELECTOR.SIGN_IN.SUBMIT);
        cli.updateAll(['Waiting for login...']);
        const needMfa = await Promise.race([
            page.waitForSelector(SELECTOR.DASHBOARD.NAV.TRANSACTIONS).then(() => false),
            page.waitForSelector(SELECTOR.MFA.START_BUTTON).then(() => true),
        ]);

        if (needMfa) {
            cli.updateAll(['Starting 2fa...']);
            cli.hide();
            await page.click(SELECTOR.MFA.START_BUTTON);
            const mfa = (await prompt([{
                message: '2fa?',
                type: 'number',
                name: 'mfa'
            }])).mfa;
            cli.unhide();
            cli.updateAll(['Typing 2fa...']);
            await page.waitForSelector(SELECTOR.MFA.INPUT);
            await page.type(SELECTOR.MFA.INPUT, `${mfa}`);
            cli.updateAll(['Clicking 2fa submit button...']);
            await page.click(SELECTOR.MFA.SUBMIT);
            cli.updateAll(['Waiting for login (after 2fa)...']);
        }

        await page.waitForSelector(SELECTOR.DASHBOARD.NAV.TRANSACTIONS);

        let num = 0;
        while (await page.evaluate(sel => {
            return !(document.querySelector(sel).className.split(' ').includes('selected'));
        }, SELECTOR.DASHBOARD.NAV.TRANSACTIONS)) {

            cli.updateAll([`Clicking "Transactions" (${++num})...`]);
            await page.click(SELECTOR.DASHBOARD.NAV.TRANSACTIONS);
        }

        cli.updateAll(["Waiting for transactions page to load..."]);
        const SEL = SELECTOR.DASHBOARD.TRANSACTIONS;
        await page.waitForSelector(SEL.ACCOUNT_NAV.ALL_ACCOUNTS);
        cli.updateAll(["Listing accounts..."]);
        const accounts: Account[] = await page.evaluate(selector => {
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

        cli.updateAll(["Processing..."]);

        const cookies = Object.fromEntries((await page.cookies()).map(x => [x.name, x.value]));

        await browser.close();

        const transactions: Transaction[] = [];

        cli.updateAll(accounts.map(acc => `${chalk.gray(`${acc.provider} - ${acc.name}`)}: Initializing download...`));

        await Promise.all(accounts.map((account, index) => (async () => {
            const parser = get(`https://mint.intuit.com/transactionDownload.event?accountId=${account.id}&queryNew=&offset=0&comparableType=8`, { cookies: cookies })
                .pipe(csvparse({
                    bom: true,
                    columns: true,
                }));

            let cnt = 0;
            for await (const record of parser) {
                if (cnt === 0) {
                    cli.updateLine(index, `${chalk.magentaBright(`${account.provider} - ${account.name}`)}: Downloading...`);
                }
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
                cnt++;
            }

            cli.updateLine(index, `${chalk.green(`${account.provider} - ${account.name}`)}: Loaded ${chalk.magentaBright(cnt)} transactions.`);
        })()));

        return transactions.sort((a, b) => +a.date - +b.date);
    } catch (e) {
        try {
            await page.screenshot({ path: 'error.png' })
            await page.close();
        } catch(_) {}

        throw e;
    }
}
