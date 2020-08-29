import { pullAllTransactions } from './mint';
import { RunOptions } from './types/RunOptions';
import { Gnucash } from './gnucash/Gnucash';

export async function run(options: RunOptions) {
    const [ gnucash, transactions ] = await Promise.all([
        Gnucash.fromFile(options.infile),
        pullAllTransactions(options)
    ]);

    await gnucash.mergeInTransactions(transactions);

    await gnucash.writeToFile(options.outfile);
}
