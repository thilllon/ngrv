import { engrave, readEngrave } from 'ngrv';

// engrave all variables into .ngrv file
engrave();

// read engraved variables from .ngrv file
const ngrvs = readEngrave();
console.log(ngrvs);

if (!ngrvs) {
  throw new Error('test fails. ngrvs is undefined');
}

// shows all engraved variables in process.env
Object.keys(ngrvs).forEach((key) => console.log(key, process.env[key]));
