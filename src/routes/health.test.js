
import request from 'supertest';
import { expect } from 'chai';
import express from 'express';
import { router as healthRouter } from './health.js';

describe('Health Endpoint', () => {
  let app;

  before(() => {
    app = express();
    app.use(healthRouter);
  });

  it('should return 200 OK with status and uptime', async () => {
    const res = await request(app).get('/healthz');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('status').and.to.equal('ok');
    expect(res.body).to.have.property('uptime');
    expect(res.body.uptime).to.be.a('number').and.to.be.at.least(0);
    expect(Math.floor(res.body.uptime)).to.equal(res.body.uptime); // Ensure it's a whole number
  });
});
