const amqp = require('amqplib')

const { AMPQ_PREFETCH, AMQP_URL } = require('./constants')
exports.conn = null
exports.ch = null
exports.connect = async ({ url, prefetch }) => {
    const conn = exports.conn = await amqp.connect(amqpURL || AMQP_URL)
    const ch = exports.ch = await conn.createChannel()
    ch.prefetch(amqpPrefetch || AMPQ_PREFETCH)
    return ch
}

