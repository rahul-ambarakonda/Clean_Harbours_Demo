
import request from 'supertest';
import { expect } from 'chai';
import express from 'express';
import sinon from 'sinon';
import { router as waitlistRouter } from './waitlist.js';
import * as validate from '../lib/validate.js';
import * as store from '../lib/store.js';

describe('Waitlist Endpoint', () => {
  let app;
  let isValidEmailStub;
  let hasEmailStub;
  let addEntryStub;

  beforeEach(() => {
    // Create a fresh express app for each test to avoid rate limit issues between tests
    app = express();
    app.use(express.json()); // Body parser middleware is needed
    app.use(waitlistRouter);

    // Stub the dependencies to isolate waitlistRouter logic
    isValidEmailStub = sinon.stub(validate, 'isValidEmail');
    hasEmailStub = sinon.stub(store, 'hasEmail');
    addEntryStub = sinon.stub(store, 'addEntry');

    // Default successful behavior for stubs
    isValidEmailStub.returns(true);
    hasEmailStub.returns(false);
    addEntryStub.returns(Promise.resolve());
  });

  afterEach(() => {
    sinon.restore(); // Restore all stubs after each test
  });

  it('should return 400 if email is missing', async () => {
    const res = await request(app)
      .post('/api/waitlist')
      .send({});

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error');
    expect(res.body.error.code).to.equal('INVALID_EMAIL');
    expect(res.body.error.message).to.equal('Email address is missing.');
  });

  it('should return 400 if email is invalid', async () => {
    isValidEmailStub.withArgs('bad-email').returns(false);

    const res = await request(app)
      .post('/api/waitlist')
      .send({ email: 'bad-email' });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error');
    expect(res.body.error.code).to.equal('INVALID_EMAIL');
    expect(res.body.error.message).to.equal('That does not look like an email address.');
    expect(isValidEmailStub.calledWithExactly('bad-email')).to.be.true;
  });

  it('should return 409 if email already joined', async () => {
    hasEmailStub.withArgs('test@example.com').returns(Promise.resolve(true));

    const res = await request(app)
      .post('/api/waitlist')
      .send({ email: 'test@example.com' });

    expect(res.status).to.equal(409);
    expect(res.body).to.have.property('error');
    expect(res.body.error.code).to.equal('ALREADY_JOINED');
    expect(res.body.error.message).to.equal('You are already on the list.');
    expect(hasEmailStub.calledWithExactly('test@example.com')).to.be.true;
    expect(addEntryStub.notCalled).to.be.true;
  });

  it('should return 201 for a successful join', async () => {
    const testEmail = 'new@example.com';
    const res = await request(app)
      .post('/api/waitlist')
      .send({ email: testEmail });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('status').and.to.equal('joined');
    expect(isValidEmailStub.calledWithExactly(testEmail)).to.be.true;
    expect(hasEmailStub.calledWithExactly(testEmail)).to.be.true;
    expect(addEntryStub.calledOnce).to.be.true;
    // Since req.ip is simulated by supertest as ::1, it will be '::ffff:127.0.0.1' on CI systems or ipv4 fallback
    // We will check for either '::1' or '127.0.0.1' or '::ffff:127.0.0.1'
    const calledIp = addEntryStub.getCall(0).args[1];
    expect(['::1', '127.0.0.1', '::ffff:127.0.0.1']).to.include(calledIp);
  });

  it('should return 429 after exceeding rate limit', async () => {
    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/waitlist')
        .send({ email: `user${i}@example.com` });
    }

    // The 6th request should be rate-limited
    const res = await request(app)
      .post('/api/waitlist')
      .send({ email: 'rate-limited@example.com' });

    expect(res.status).to.equal(429);
    expect(res.body).to.have.property('error');
    expect(res.body.error.code).to.equal('RATE_LIMITED');
    expect(res.body.error.message).to.equal('Too many attempts. Try again in a minute.');
  }).timeout(20000); // Increase timeout for rate limit test
});
