class Command {
    apply() {}
    revert() {}
}

class FunctionCommand extends Command {
    constructor(doFn, undoFn, label = "") {
        super();
        this.doFn = doFn;
        this.undoFn = undoFn;
        this.label = label;
    }

    apply() {
        this.doFn();
    }

    revert() {
        this.undoFn();
    }
}

class History {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.limit = 200;
        this.listeners = [];
    }

    onChange(fn) {
        this.listeners.push(fn);
        return () => {
            const index = this.listeners.indexOf(fn);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    emit() {
        for (const fn of this.listeners) fn(this);
    }

    execute(command) {
        command.apply();
        this.undoStack.push(command);
        if (this.undoStack.length > this.limit) this.undoStack.shift();
        this.redoStack.length = 0;
        this.emit();
        return command;
    }

    push(command) {
        this.undoStack.push(command);
        if (this.undoStack.length > this.limit) this.undoStack.shift();
        this.redoStack.length = 0;
        this.emit();
    }

    undo() {
        const command = this.undoStack.pop();
        if (!command) return false;
        command.revert();
        this.redoStack.push(command);
        this.emit();
        return true;
    }

    redo() {
        const command = this.redoStack.pop();
        if (!command) return false;
        command.apply();
        this.undoStack.push(command);
        this.emit();
        return true;
    }

    get canUndo() {
        return this.undoStack.length > 0;
    }

    get canRedo() {
        return this.redoStack.length > 0;
    }

    clear() {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
        this.emit();
    }
}

// Snapshots whole-document state; simplest correct approach for structural edits.
class SnapshotCommand extends Command {
    constructor(document, before, after, label = "") {
        super();
        this.document = document;
        this.before = before;
        this.after = after;
        this.label = label;
    }

    apply() {
        this.document.restore(this.after);
    }

    revert() {
        this.document.restore(this.before);
    }
}
