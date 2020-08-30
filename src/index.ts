import { prompt } from 'inquirer';
import { pullAllTransactions } from './mint';
import { RunOptions } from './types/RunOptions';
import { Gnucash } from './gnucash/Gnucash';
import { Account, Transaction } from './types';
import { Book } from './gnucash/Book';
import { Transaction as GnucashTransaction } from './gnucash/Transaction';
import { Account as GnucashAccount } from './gnucash/Account';

export async function run(options: RunOptions) {
    const [ gnucash, transactions ] = await Promise.all([
        Gnucash.fromFile(options.infile),
        pullAllTransactions(options)
    ]);

    await linkAccounts(transactions, gnucash.getBook());
    await mergeInTransactions(transactions, gnucash.getBook());

    await gnucash.writeToFile(options.outfile);
}

async function linkAccounts(transactions: Transaction[], book: Book) {
    const accounts = Array.from(new Set(transactions.map(value => value.account)).values());

    for (const account of accounts) {
        await getOrSetGnucashAccountForMintAccount(account, book);
    }
}

async function mergeInTransactions(transactions: Transaction[], book: Book) {
    for (const transaction of transactions) {

        const sourceAccount = book.getAccountForMintAccount(transaction.account);

        const exists = !!book.getTransactions().find(trans =>
            trans.getDatePosted().equals(transaction.date) &&
            trans.getDescription() === transaction.description &&
            trans.getSplits().find(sp => sp.getAccountId() === sourceAccount.getId()));
        if (exists) continue;

        const destAccount = await promptForAccount(
            `${transaction.date.toISO()}: ${sourceAccount.getName()}: ${transaction.description}`,
            book.getAccounts().filter(a => !a.isRoot() && a !== sourceAccount),
            book
        );

        book.addChild(
            GnucashTransaction.fromObj({
                datePosted: transaction.date,
                description: transaction.description,
                splits: [
                    {
                        accountId: sourceAccount.getId(),
                        value: transaction.amount,
                        quantity: transaction.amount,
                        reconciledState: false
                    }, {
                        accountId: destAccount.getId(),
                        value: -transaction.amount,
                        quantity: -transaction.amount,
                        reconciledState: false
                    }
                ]
            }).getXML()
        )
    }

}

async function getOrSetGnucashAccountForMintAccount(mintAccount: Account, book: Book): Promise<GnucashAccount> {
    let ret = book.getAccounts()
        .find(acc => acc.getMintAccountId() === mintAccount.id);

    if (!ret) {
        ret = await promptForAccount(
            `Which Gnucash account corresponds to ${mintAccount.provider} - ${mintAccount.name}?`,
            book.getAccounts().filter(acc => !acc.isRoot() && acc.getMintAccountId() === null),
            book);
        ret.setMintAccountId(mintAccount.id);
    }

    return ret;
}

async function promptForAccount(message: string, accounts: GnucashAccount[], book: Book): Promise<GnucashAccount> {
    return await prompt([{
        message: message,
        type: 'list',
        choices: accounts
            .map(account => ({
                name: account.getChoiceName(book),
                value: account,
            })),
        name: 'account',
    }]).then(obj => obj.account);
}