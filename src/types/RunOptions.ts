export interface RunOptions {
    email: string;
    password?: string;
    infile: string;
    outfile: string;
    since?: import('luxon').DateTime;
}
