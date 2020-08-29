import { GncElement } from "./GncElement";
import { Transaction } from "./Transaction";
import { Account } from "./Account";
import { Account as MintAccount, Transaction as MintTransaction } from '../types';
import { prompt } from 'inquirer';

export class Book extends GncElement {
    getId() {
        return this.getChildText('book:id');
    }

    countCommodities() {
        return this.getCount('commodity');
    }

    countAccounts() {
        return this.getCount('account');
    }

    countTransactions() {
        return this.getCount('transaction');
    }

    getAccounts() {
        return this.makeOrReturn('accounts', () => this.getChildren('gnc:account').map(x => new Account(x)));
    }

    getAccountById(id: string): Account {
        const ret = this.getAccounts().find(acc => acc.getId() === id);
        if (!ret) throw new Error(`Cannot find account with id ${JSON.stringify(id)}`);
        return ret;
    }

    getAccountForMintAccount(mintAccount: MintAccount): Account {
        const ret = this.getAccounts()
            .find(acc => acc.getMintAccountId() === mintAccount.id);

        if (!ret) throw new Error(`Cannot find account that matches "${mintAccount.provider} - ${mintAccount.name} (${mintAccount.id})`);
        return ret;
    }

    async getOrSetAccountForMintAccount(mintAccount: MintAccount): Promise<Account> {
        let ret = this.getAccounts()
            .find(acc => acc.getMintAccountId() === mintAccount.id);

        if (!ret) {
            ret = await this.promptForAccount(`Which Gnucash account corresponds to ${mintAccount.provider} - ${mintAccount.name}?`, acc => acc.getMintAccountId() === null);
            ret.setMintAccountId(mintAccount.id);
        }

        return ret;
    }

    getTransactions() {
        return this.makeOrReturn('transactions', () => this.getChildren('gnc:transaction').map(x => new Transaction(x)));
    }

    async mergeInTransactions(transactions: MintTransaction[]) {
        const accounts = Array.from(new Set(transactions.map(value => value.account)).values());

        for (const account of accounts) {
            await this.getOrSetAccountForMintAccount(account);
        }

        this.invalidateMakeOrReturn('transactions');
        for (const transaction of transactions) {

            const sourceAccount = this.getAccountForMintAccount(transaction.account);

            const exists = !!this.getTransactions().find(trans =>
                trans.getDatePosted().equals(transaction.date) &&
                trans.getDescription() === transaction.description &&
                trans.getSplits().find(sp => sp.getAccountId() === sourceAccount.getId()));
            if (exists) continue;

            const destAccount = await this.promptForAccount(
                `${transaction.date.toISO()}: ${sourceAccount.getName()}: ${transaction.description}`,
                a => a !== sourceAccount
            );

            this.addChild(
                Transaction.fromObj({
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

    async promptForAccount(message: string, filter?: (a: Account) => boolean): Promise<Account> {
        return await prompt([{
            message: message,
            type: 'list',
            choices: this.getAccounts()
                .filter(acc => !acc.isRoot())
                .filter(acc => !filter || filter(acc))
                .map(account => ({
                    name: account.getChoiceName(this),
                    value: account,
                })),
            name: 'account',
        }]).then(obj => obj.account);
    }
}