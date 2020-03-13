const amqp = require('amqplib')

const { AMPQ_PREFETCH, AMQP_URL } = require('./constants')
exports.conn = null
exports.ch = null
exports.connect = async (options = {}) => {
    const conn = exports.conn = await amqp.connect(options.url || AMQP_URL)
    const ch = exports.ch = await conn.createChannel()
    ch.prefetch(options.prefetch || AMPQ_PREFETCH)
    return ch
}

