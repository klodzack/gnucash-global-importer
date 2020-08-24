import { pullAllTransactions } from './mint';
import * as fs from 'fs-extra';
import { RunOptions } from './RunOptions';

export async function run(options: RunOptions) {
    const transactions = await pullAllTransactions(options);
    await fs.writeFile(options.outfile, JSON.stringify(transactions));
}
