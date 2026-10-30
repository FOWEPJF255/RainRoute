'use strict';
const {DatabaseSync}=require('node:sqlite');
module.exports=function makeDb(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE quota_buckets (key TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL)');
  return {prepare(sql){const statement=sqlite.prepare(sql);return {bind(...values){return {async first(){return statement.get(...values)||null;},async run(){return statement.run(...values);}};}};}};
};
