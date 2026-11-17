import { Buffer } from "node:buffer";

const crcLookup=Uint32Array.from({length:256},(_,byte)=>{
  for(let i=0;i<8;i++)byte=byte&1?(byte>>>1)^0xedb88320:byte>>>1;
  return byte>>>0;
});
function checksum(content:Uint8Array) {
  let value=0xffffffff;
  for(const byte of content)value=(value>>>8)^crcLookup[(value^byte)&255];
  return (value^0xffffffff)>>>0;
}

export function createZip(files:{name:string;content:Uint8Array}[]) {
  if(files.length>65535)throw new Error("Archive limit exceeded.");
  const chunks:Buffer[]=[];
  const directory:Buffer[]=[];
  let offset=0,size=0;
  for(const file of files) {
    if(!/^[A-Za-z0-9._-]{1,90}$/.test(file.name))throw new Error("Invalid archive name.");
    const name=Buffer.from(file.name), content=Buffer.from(file.content);
    if(offset+content.length>64*1024*1024)throw new Error("Archive limit exceeded.");
    const crc=checksum(content), local=Buffer.alloc(30), central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(33,12);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(content.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(name.length,26);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(33,14);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(content.length,20);central.writeUInt32LE(content.length,24);
    central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    chunks.push(local,name,content);directory.push(central,name);
    offset+=local.length+name.length+content.length;size+=central.length+name.length;
  }
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,...directory,end]);
}
