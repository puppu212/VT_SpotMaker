export function createHistory(limit = 80) {
  const undoStack = [];
  const redoStack = [];

  return {
    checkpoint(value) {
      undoStack.push(clone(value));
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
    },
    undo(current) {
      if (!undoStack.length) return null;
      redoStack.push(clone(current));
      return undoStack.pop();
    },
    redo(current) {
      if (!redoStack.length) return null;
      undoStack.push(clone(current));
      return redoStack.pop();
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
