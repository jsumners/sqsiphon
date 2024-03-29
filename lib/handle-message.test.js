'use strict';

const tap = require('tap');
const symbols = require('./symbols');
const handleMessage = require('./handle-message');

tap.test('emits processing-error for bad handler', async t => {
  const sqs = {
    deleteMessage() {
      t.fail('should not be invoked');
      return this;
    },
    promise() {
      t.fail('should not be invoked');
      return Promise.reject(Error('broken sqs'));
    }
  };
  async function handler() {
    throw Error('broken handler');
  }
  const app = {
    [symbols.symSQS]: sqs,
    [symbols.symQueueUrl]: 'http://sqs.example.com',
    [symbols.symHandler]: handler,

    emit(event, body) {
      t.equal(event, 'processing-error');
      t.match(body, {
        message: 'foo',
        error: {
          message: 'broken handler'
        }
      });
    }
  };

  const result = await handleMessage({ message: 'foo', app });
  t.equal(result, false);
});

tap.test('emits processing-error for broken sqs', async t => {
  const sqs = {
    deleteMessage() {
      return this;
    },
    promise() {
      return Promise.reject(Error('broken sqs'));
    }
  };
  async function handler() {
    return true;
  }
  const app = {
    [symbols.symSQS]: sqs,
    [symbols.symQueueUrl]: 'http://sqs.example.com',
    [symbols.symHandler]: handler,

    emit(event, body) {
      t.equal(event, 'processing-error');
      t.match(body, {
        message: 'foo',
        error: {
          message: 'broken sqs'
        }
      });
    }
  };

  const result = await handleMessage({ message: 'foo', app });
  t.equal(result, false);
});

tap.test('emits handled-message on success', async t => {
  const sqs = {
    deleteMessage(params) {
      t.strictSame(params, {
        QueueUrl: 'http://sqs.example.com',
        ReceiptHandle: 'handle-1'
      });
      return this;
    },
    promise() {
      return Promise.resolve();
    }
  };
  async function handler(message) {
    t.strictSame(message, { foo: 'foo', ReceiptHandle: 'handle-1' });
    return true;
  }
  const app = {
    [symbols.symSQS]: sqs,
    [symbols.symQueueUrl]: 'http://sqs.example.com',
    [symbols.symHandler]: handler,

    emit(event, body) {
      t.equal(event, 'handled-message');
      t.strictSame(body, { message: { foo: 'foo', ReceiptHandle: 'handle-1' } });
    }
  };

  const result = await handleMessage({ message: { foo: 'foo', ReceiptHandle: 'handle-1' }, app });
  t.equal(result, true);
});

tap.test('does not throw for rejections', async t => {
  const sqs = {
    deleteMessage() {
      return this;
    },
    promise() {
      return Promise.reject(Error('sqs failed'));
    }
  };
  async function handler() {
    return true;
  }
  const app = {
    [symbols.symSQS]: sqs,
    [symbols.symQueueUrl]: 'http://sqs.example.com',
    [symbols.symHandler]: handler,

    emit(event, body) {
      t.equal(event, 'processing-error');
      t.same(body, {
        error: { message: 'sqs failed', name: 'Error' },
        message: { foo: 'foo', ReceiptHandle: 'handle-1' }
      });
    }
  };

  try {
    const result = await handleMessage({
      message: { foo: 'foo', ReceiptHandle: 'handle-1' },
      app
    });
    t.equal(result, false);
  } catch (error) {
    t.error(error);
  }
});
