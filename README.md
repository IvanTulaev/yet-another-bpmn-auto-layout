# bpmn-auto-layout-feat-ivan-tulaev

Create and layout the graphical representation of a BPMN diagram.

## [DEMO](https://ivantulaev.github.io/yet-another-bpmn-auto-layout/)

## Differences with original repository

* Given a collaboration **ALL** participant's process will be laid out.
* **Collapsed** and **expanded sub-processes** has different layout.
* Independent graphs of process are laid out on different grid lines.
* **Data Associations** are laid out as task or gateway
* Happy path not very happy, but large process graphs are more understandable for humans :)
* Example with **step-by-step debug mode** 

## Usage

This library works with [Node.js](https://nodejs.org/) and in the browser.

```javascript
import { layoutProcess } from 'yet-another-bpmn-auto-layout';

import diagramXML from './diagram.bpmn';

const diagramWithLayoutXML = await layoutProcess(diagramXML);

console.log(diagramWithLayoutXML);
```

## Limitations

* The following elements are not laid out:
  * Groups
  * Text annotations
  * Lanes

## Resources

* [Issues](https://github.com/IvanTulaev/yet-another-bpmn-auto-layout/issues)



## Run example (for BAs, SAs and other business people :) )
1. Run in terminal commands below 
    ```sh
    git clone https://github.com/IvanTulaev/yet-another-bpmn-auto-layout.git
    cd yet-another-bpmn-auto-layout
    npm install
    npm start
    ```
2. Browser will open tab at http://localhost:8080 or on another port if 8080 is busy.
3. Upload your BPMN to the left side (**Left-bottom button "Open"**).
4. Take the placed BPMN from the right side (**Right-bottom button "Download"**).

## Build and Run

```sh
# install dependencies
npm install

# build and run tests
npm run all

# run example
npm start
```

## Test

We use snapshot testing to verify old and new layout attempts. A mismatch is indicated as a test failure.

```sh
# run tests
npm test

# inspect the results
npm run test:inspect

# run update snapshots
npm run test:update-snapshots
```

Add new test cases to [`test/fixtures`](./test/fixtures) and they will be picked up automatically.

## License

[MIT](./LICENSE)
