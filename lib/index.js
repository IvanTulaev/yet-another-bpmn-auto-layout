import { Layouter } from './Layouter.js';

/**
 * @typedef {'string' | 'moddle'} BpmnDataType
 */

/**
 * @typedef {Object} OutputOptions
 * @property {BpmnDataType} [type="string"] - type of output data
 * @property {boolean} [format=false] - formated string if type = string
 */

/**
 * @typedef {Object} DebugOptions
 * @property {number} [steps=] - count of layout steps before layout process stop
 */

/**
 * @typedef {Object} LayoutOptions
 * @property {OutputOptions} [output=]  - output settings
 * @property {DebugOptions} [debug=] - debug settings
 */

/**
 *
 * @param {string|object} inputData - xml string or bpmn definition moddle object
 * @param {LayoutOptions} options - layout options for fine-tuning
 * @returns {Promise<*>}
 */
export function layoutProcess(inputData, options) {
  return new Layouter(options).layoutProcess(inputData);
}
