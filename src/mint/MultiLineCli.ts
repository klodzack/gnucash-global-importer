import { default as ansi } from 'ansi';

const cursor = ansi(process.stdout);

export class MultiLineCli {
    constructor(private lines: string[]) {
        this.drawAll();
    }

    redraw() {
        this.eraseAll();
        this.drawAll();
    }

    private eraseAll() {
        for (const line of this.lines) {
            cursor.previousLine();
            cursor.eraseLine();
        }
    }

    private drawAll() {
        for (const line of this.lines) {
            cursor.write(line);
            cursor.write('\n');
        }
    }

    updateLine(index: number, newLine: string) {
        this.lines[index] = newLine;

        const up = this.lines.length - index;
        for (let i=0; i<up; i++) {
            cursor.previousLine();
        }

        cursor.eraseLine();
        cursor.write(newLine);
        cursor.write('\n');

        for (let i=1; i<up; i++) {
            cursor.nextLine();
        }
    }

    updateAll(newLines: string[]) {
        this.eraseAll();
        this.lines = newLines;
        this.drawAll();
    }
}
