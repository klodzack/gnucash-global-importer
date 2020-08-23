import { pullAllTransactions } from './mint';

(async () => {

    console.dir(await pullAllTransactions('klod.zack@gmail.com'));

})().catch(e => {
    console.error(e);
    process.exit(1);
});