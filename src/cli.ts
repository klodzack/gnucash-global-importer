import * as yargs from 'yargs';
import { run } from './index';

function runAsync(x: () => Promise<any>) {
    x().catch(e => {
        console.error(e);
        process.exit(1);
    });
}

(async () => {

    yargs
        .demandCommand(1, '')
        .command(
            'sync <infile> <email> <outfile>',
            'Pull transactions from mint, add them to gnucash.',
            y => y
                .positional('infile', { description: 'Input gnucash file' })
                .positional('email', { description: 'Email address for Mint login' })
                .positional('outfile', { description: 'Output gnucash file' })
                .option('password', { alias: 'p' })
                ,
            args => runAsync(async () => {
                await run({
                    infile: args.infile as string,
                    email: args.email as string,
                    outfile: args.outfile as string,
                    password: args.password as (string | undefined),
                });
            })
        )
        .showHelpOnFail(true)
        .argv;

})().catch(e => {
    console.error(e);
    process.exit(1);
});
