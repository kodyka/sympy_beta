// Import the LambdaWorker class from the "@libreservice/my-worker" library
import { LambdaWorker } from '@libreservice/my-worker'

// Create a new worker instance using the path to the Pyodide worker script on AWS Lambda
const pyodideWorker = new LambdaWorker('/pyodideWorker.js')

// Define a type for a callback function that takes an object with a "stage" string and optional "errorMsg" string as its argument
type StageCallback = (arg: { stage: string, errorMsg?: string }) => void

// Define a function that takes a callback function of the above type and passes it to the Pyodide worker as a control message
function registerStageCallback (arg: StageCallback) {
  pyodideWorker.control('stage', arg)
}

// Define a function that takes an input string and an optional variable name, evaluates the input using the Pyodide worker, and returns the result and any error message as a Promise.
const evalInput: (input: string, variable?: string) => Promise<{
  result: InputResult[]
  error: string
}> = pyodideWorker.register('evalInput')

// Define a function that takes a LaTeX input string, evaluates it using the Pyodide worker, and returns the resulting LaTeX output and any error message as a Promise.
const evalLatexInput: (input: string) => Promise<{
  result: string
  error: string
}> = pyodideWorker.register('evalLatexInput')

// Define a function that simply evaluates the current card in the Pyodide worker context and returns the result and any error message as a Promise.
const evalCard = pyodideWorker.register('evalCard')

// Define a function that retrieves the version number of Pyodide running on the worker and returns it as a Promise.
const getPyodideVersion: () => Promise<string> = pyodideWorker.register('getPyodideVersion')

// Define a function that retrieves the version number of SymPy (a Python library) running on the worker and returns it as a Promise.
const getSymPyVersion: () => Promise<string> = pyodideWorker.register('getSymPyVersion')

// Export all the defined functions so they can be used in other modules
export { evalInput, evalLatexInput, evalCard, getPyodideVersion, getSymPyVersion, registerStageCallback }
