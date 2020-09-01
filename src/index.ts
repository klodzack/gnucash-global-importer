import { prompt } from 'inquirer';
prompt.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
import { pullAllTransactions } from './mint';
import { RunOptions } from './types/RunOptions';
import { Gnucash } from './gnucash/Gnucash';
import { Account, Transaction } from './types';
import { Book } from './gnucash/Book';
import { Transaction as GnucashTransaction } from './gnucash/Transaction';
import { Account as GnucashAccount } from './gnucash/Account';

const EXIT_WITHOUT_SAVING = Symbol();
const SAVE_AND_EXIT = Symbol();


export async function run(options: RunOptions) {
    const [ gnucash, transactions ] = await Promise.all([
        Gnucash.fromFile(options.infile),
        pullAllTransactions(options)
    ]);

    const filteredTransactions = transactions.filter(t => !options.since || options.since < t.date);

    await linkAccounts(filteredTransactions, gnucash.getBook());
    await mergeInTransactions(filteredTransactions, gnucash.getBook());

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
            `${transaction.date.toSQL()}: \$${transaction.amount} ${sourceAccount.getName()}: ${transaction.description}`,
            book.getAccounts().filter(a => !a.isRoot() && a !== sourceAccount),
            book,
            true
        );

        if (destAccount === SAVE_AND_EXIT) return;
        if (destAccount === EXIT_WITHOUT_SAVING) process.exit(0);

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

async function promptForAccount(message: string, accounts: GnucashAccount[], book: Book, exitOptions?: false): Promise<GnucashAccount>;
async function promptForAccount(message: string, accounts: GnucashAccount[], book: Book, exitOptions: true): Promise<GnucashAccount | typeof SAVE_AND_EXIT | typeof EXIT_WITHOUT_SAVING>;
async function promptForAccount(message: string, accounts: GnucashAccount[], book: Book, exitOptions = false): Promise<GnucashAccount | typeof SAVE_AND_EXIT | typeof EXIT_WITHOUT_SAVING> {
    const choices = accounts.map(account => ({
        name: account.getChoiceName(book),
        value: account,
    }));

    const extraMenuOptions = exitOptions
        ? [
            { name: '------', value: null },
            { name: 'Exit Without Saving', value: EXIT_WITHOUT_SAVING },
            { name: 'Save & Exit', value: SAVE_AND_EXIT },
            { name: '------', value: null },
        ]
        : [];

    let ret: GnucashAccount | typeof EXIT_WITHOUT_SAVING | typeof SAVE_AND_EXIT | null = null;
    while (ret === null) {
        ret = await prompt([{
            message: message,
            type: 'autocomplete',
            name: 'account',
            source: (_: unknown, input = '') => {
                const search = input.toLowerCase().trim();
                const entirePhraseContained = choices.filter(choice => choice.name.toLowerCase().includes(search));
                const searchWords = search.split(/\s+/).filter(word => word.length);
                const eachWordContained = choices.filter(choice => 
                    !entirePhraseContained.includes(choice) &&
                    searchWords.every(word => choice.name.toLowerCase().includes(word)));
                return [
                    ...entirePhraseContained,
                    ...eachWordContained,
                    ...extraMenuOptions,
                ];
            }
        }]).then(obj => obj.account);
    }
    return ret;
}
