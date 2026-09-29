// Shared Web Crypto format. Keys derive from the password, never from a public verifier.
const utf8=new TextEncoder();
const context=utf8.encode('ariel-morning-edit:v1');
const b64=bytes=>{let value='';for(let i=0;i<bytes.length;i+=4096)value+=String.fromCharCode(...bytes.subarray(i,i+4096));return btoa(value);};
const bytes=value=>Uint8Array.from(atob(value),x=>x.charCodeAt(0));
export async function encrypt(text,password){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(password,salt);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:context},key,utf8.encode(text));
 return {version:1,kdf:'PBKDF2-SHA256',iterations:600000,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};
}
async function derive(password,salt){
 const material=await crypto.subtle.importKey('raw',utf8.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function decrypt(envelope,password){
 if(envelope.version!==1||envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==600000||envelope.cipher!=='AES-256-GCM')throw new Error('Unsupported encrypted edition');
 const salt=bytes(envelope.salt),iv=bytes(envelope.iv);if(salt.length!==16||iv.length!==12)throw new Error('Invalid encrypted edition');
 const key=await derive(password,salt);
 return new TextDecoder('utf-8',{fatal:true}).decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:context},key,bytes(envelope.ciphertext)));
}
