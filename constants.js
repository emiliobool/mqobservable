const uuidv1 = require('uuid/v1')

exports.AMPQ_PREFETCH = process.env.AMPQ_PREFETCH || 0
exports.AMQP_URL = process.env.AMQP_URL
exports.CONSUMER_EXCHANGE = process.env.CONSUMER_EXCHANGE || 'consumer_exchange'
exports.PUBLISHER_EXCHANGE =
    process.env.PUBLISHER_EXCHANGE || 'publisher_exchange'
exports.DEDUPE_EXCHANGE = process.env.DEDUPE_EXCHANGE || 'dedupe_exchange'
exports.QUEUE_PREFIX = process.env.QUEUE_PREFIX || 'queue_'
exports.REPLY_ROUTING_KEY = process.env.REPLY_ROUTING_KEY || uuidv1()
exports.ERROR_ROUTING_KEY = process.env.ERROR_ROUTING_KEY || uuidv1()
