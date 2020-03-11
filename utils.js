const { PUBLISHER_EXCHANGE } = require('./constants')

const getRoute = route => {
    if (route.__routingKey__) {
        return route.__routingKey__
    } else {
        return route
    }
}

const wrapData = (data, state, error) => ({ data, state, error })

const publishJSON = (ch, exchange, route, content, options) => {
    exchange = exchange || PUBLISHER_EXCHANGE
    route = getRoute(route)
    if (content === undefined) {
        content = null
    }
    content = Buffer.from(JSON.stringify(content))
    options = {
        contentType: 'application/json',
        ...options
    }
    return ch.publish(exchange, route, content, options)
}

function publishErrorResponse(ch, msg, routingKey, error, ex) {
    const correlationId = msg.properties.correlationId
    routingKey =
        msg.properties.headers['x-error-route'] ||
        routingKey ||
        `${msg.fields.routingKey}.error`
    const content = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    publishJSON(ch, ex, routingKey, content, { correlationId })
}

function publishResponse(ch, msg, route, content = {}, exchange, options = {}) {
    if (msg.properties.replyTo) {
        msg.channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify(content)),
            {
                correlationId: msg.properties.correlationId
            }
        )
    } else {
        route =
            msg.properties.headers['x-reply-route'] ||
            route ||
            `${msg.fields.routingKey}.response`
        if (msg.properties.correlationId) {
            options.correlationId = msg.properties.correlationId
        }
        publishJSON(ch, exchange, route, content, options)
    }
}

const ackMsg = msg => {
    if (!msg.acked) {
        msg.channel.ack(msg)
    }
    msg.acked = true
}

const nackMsg = msg => {
    if (!msg.acked) {
        msg.channel.nack(msg)
    }
    msg.acked = true
}

const dedupe = (ex, route, content, key, ttl) => {
    if (typeof key === 'function') key = key(content)
    if (typeof key === 'object') key = JSON.stringify(key)
    if (!key) key = JSON.stringify(content)
    const options = { 'x-deduplication-header': key }
    if (ttl) options['x-cache-ttl'] = ttl
    publishJSON(ch, ex, route, content, options)
    return content
}

exports.dedupe = dedupe
exports.ackMsg = ackMsg
exports.nackMsg = nackMsg
exports.publishResponse = publishResponse
exports.publishErrorResponse = publishErrorResponse
exports.publishJSON = publishJSON
exports.getRoute = getRoute
exports.wrapData = wrapData
