require('reflect-metadata');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { PostgresAuthModule } = require('./src/auth/postgres-auth.module.ts');
const { PostgresAuthService } = require('./src/auth/postgres-auth.service.ts');
const { PostgresService } = require('./src/nest/infrastructure/postgres.service.ts');
let queries = 0;
const postgres = {query: async () => ({rowCount: ++queries === 1 ? 1 : 0})};
class TestRoot {}
class TestInfra {}
(async () => {
 const app = await NestFactory.create({module: TestRoot, imports: [
  {module:TestInfra, global:true, providers:[{provide:PostgresService,useValue:postgres}],exports:[PostgresService]},
  PostgresAuthModule.register({devAuth:true}, {})
 ]}, new ExpressAdapter(), {logger:false,abortOnError:false});
 try {
  await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  async function post(route,body){return fetch(base+'/api/auth/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
  const invalid=await post('request',{phone:'bad'});assert.equal(invalid.status,400);
  const valid=await post('request',{phone:'+243999999999'});assert.equal(valid.status,201);const result=await valid.json();assert.match(result.devCode,/^\d{6}$/);assert.equal(result.expiresIn,300);
  const limited=await post('request',{phone:'+243999999999'});assert.equal(limited.status,429);
  const service=app.get(PostgresAuthService);service.verify=async(input)=>({token:'test-token',profile:{name:input.name}});
  const verified=await post('verify',{phone:'+243999999999',code:'123456',name:'Test',role:'passenger',city:'lubumbashi'});assert.equal(verified.status,201);assert.equal((await verified.json()).token,'test-token');
  console.log('PASS: actual Nest HTTP wiring under tsx: validation, OTP request, cooldown, verify delegation. PostgreSQL mocked.');
 } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
