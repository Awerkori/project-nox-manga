const message = "Object literal may only specify known properties, and 'owner_id' does not exist in type...";
const objMatch = message.match(/Object literal may only specify known properties, and '([a-z0-9_]+)' does not exist/);
console.log(objMatch[1]);
