const fs = require('fs');
const path = require('path');

const root = 'd:/DevCenter/abuilds/fina/finaflow/api';
const files = fs.readdirSync(root).filter((name) => name.endsWith('.ts'));

function addReturning(source) {
  let result = '';
  let index = 0;

  while (index < source.length) {
    const insertIndex = source.indexOf('.insert(', index);
    if (insertIndex === -1) {
      result += source.slice(index);
      break;
    }

    result += source.slice(index, insertIndex);

    const valuesIndex = source.indexOf('.values(', insertIndex);
    if (valuesIndex === -1) {
      result += source.slice(insertIndex);
      break;
    }

    let cursor = valuesIndex + '.values('.length;
    let depth = 1;
    while (cursor < source.length && depth > 0) {
      const ch = source[cursor];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      cursor++;
    }

    if (depth !== 0) {
      result += source.slice(insertIndex);
      break;
    }

    let statementEnd = cursor;
    while (statementEnd < source.length && source[statementEnd] !== ';') statementEnd++;
    const statement = source.slice(insertIndex, statementEnd);
    if (statement.includes('.returning(')) {
      result += source.slice(insertIndex, statementEnd);
      index = statementEnd;
      continue;
    }

    result += source.slice(insertIndex, cursor) + '.returning()' + source.slice(cursor, statementEnd);
    index = statementEnd;
  }

  return result;
}

for (const file of files) {
  const filePath = path.join(root, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  content = addReturning(content);
  content = content.replace(/Number\((\w+)\.insertId\)/g, '$1.id');
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`updated ${file}`);
  }
}
