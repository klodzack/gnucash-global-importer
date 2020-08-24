import { MultiLineCli } from "./MultiLineCli";

export class HideableMultiLineCli extends MultiLineCli {
    private hidden = true;

    constructor(private hideableLines: string[]) {
        super([]);
    }

    updateLine(index: number, newLine: string) {
        this.hideableLines[index] = newLine;

        if (!this.hidden) super.updateLine(index, newLine);
    }

    updateAll(newLines: string[]) {
        this.hideableLines = newLines;

        if (!this.hidden) super.updateAll(newLines);
    }

    hide() {
        this.hidden = true;
        super.updateAll([]);
    }

    unhide() {
        this.hidden = false;
        super.updateAll(this.hideableLines);
    }
}