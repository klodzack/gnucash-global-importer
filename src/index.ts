import { pullAllTransactions } from './mint';

(async () => {

    await pullAllTransactions('klod.zack@gmail.com');

})().catch(e => {
    console.error(e);
    process.exit(1);
});