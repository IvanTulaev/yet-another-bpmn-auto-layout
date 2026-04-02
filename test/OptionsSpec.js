import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { layoutProcess } from '../lib/index.js';
import isEqual from 'lodash/isEqual.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDirectory = path.join(__dirname, 'fixtures');


describe('Options', function() {

  fs.readdirSync(fixturesDirectory)
    .filter(fileName => fileName.endsWith('.bpmn'))
    .forEach(fileName => {
      iit(fileName)(`should same results ${ fileName }`, async function() {

        const xml = fs.readFileSync(path.join(fixturesDirectory, fileName), 'utf8');
        const resultString = await layoutProcess(xml, { output: { type: 'string', format: true } });
        const resultModdle = await layoutProcess(xml, { output: { type: 'moddle' } });

        // first flow
        const string_0 = await layoutProcess(resultString, { output: { type: 'string', format: true } });
        const moddle_1 = await layoutProcess(string_0, { output: { type: 'moddle' } });
        const string_1 = await layoutProcess(moddle_1, { output: { type: 'string', format: true } });

        // second flow
        const moddle_0 = await layoutProcess(resultString, { output: { type: 'moddle' } });
        const string_2 = await layoutProcess(moddle_0, { output: { type: 'string', format: true } });
        const moddle_2 = await layoutProcess(moddle_0, { output: { type: 'moddle', format: true } });

        // xml strings check
        assert.strictEqual(string_0, resultString, `Strings 0 & resultString are equal ${ fileName }`);
        assert.strictEqual(string_1, resultString, `Strings 1 & resultString are equal ${ fileName }`);
        assert.strictEqual(string_2, resultString, `Strings 2 & resultString are equal ${ fileName }`);

        // moddle objects check
        assert.strictEqual(isEqual(moddle_0, resultModdle), true, `Moddles 0 & resultModdle are equal ${ fileName }`);
        assert.strictEqual(isEqual(moddle_1, resultModdle), true, `Moddles 1 & resultModdle are equal ${ fileName }`);
        assert.strictEqual(isEqual(moddle_2, resultModdle), true, `Moddles 2 & resultModdle are equal ${ fileName }`);
      });
    });
});


/**
 * Return the matcher for the spec of the given name.
 *
 * @param {string} fileName
 * @return {any} mochaFN
 */
function iit(fileName) {
  if (fileName.startsWith('ONLY')) {
    return it.only;
  }

  if (fileName.startsWith('SKIP')) {
    return it.skip;
  }

  return it;
}