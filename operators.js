// const { isObservable, of } = require('rxjs')
const { pipe, map, tap, mergeMap, catchError } = require('rxjs/operators')

const { ch } = require('./amqp')
const { publishJSON, nackMsg, ackMsg, dedupe } = require('./utils')
const { RPC, reply } = require('./creators')
const { PUBLISHER_EXCHANGE, DEDUPE_EXCHANGE } = require('./constants')

const ack = () => tap(ackMsg)
const nack = () => tap(nackMsg)

const publish = (route, exchange, options = {}) =>
    tap(content => publishJSON(ch, exchange, route, content, options))

const publishMap = (route, exchange, options = {}) =>
    map(content => {
        publishJSON(ch, exchange, route, content, options)
        return content
    })

const dedupeQueueTap = (route, key) =>
    tap(content => dedupe(PUBLISHER_EXCHANGE, route, content, key))

const dedupeQueueMap = (route, key) =>
    map(content => dedupe(PUBLISHER_EXCHANGE, route, content, key))

const dedupeExchangeTap = (route, key, ttl) =>
    tap(content => dedupe(DEDUPE_EXCHANGE, route, content, key, ttl))

const dedupeExchangeMap = (route, key, ttl) =>
    map(content => dedupe(DEDUPE_EXCHANGE, route, content, key, ttl))

const replyMap = (callback, exchange, options = {}) =>
    map(msg => reply(msg, callback, exchange, options))

const replyMergeMap = (callback, exchange, options = {}) =>
    mergeMap(msg => reply(msg, callback, exchange, options))

const replyTap = (callback, exchange, options = {}) =>
    tap(msg => reply(msg, callback, exchange, options).subscribe())

const forward = (routingKey, content, ex, options = {}) =>
    tap(msg => publishJSON(msg.channel, ex, routingKey, content || msg.content, options))

const unwrapMsg = () => map(msg => msg.content)
const unwrapData = () => map(msg => msg.content.data)
const unwrapState = () => map(msg => msg.content.state)
const wrapState = state =>
    pipe(
        map(data => ({ data, state })),
        catchError(rawError => {
            const properties = Object.getOwnPropertyNames(rawError)
            const error = {}
            for (let property of properties) {
                error[property] = properties[property]
            }
            return throwError({ error, state })
        })
    )

const mergeRPC = (route, options = {}) => mergeMap(data => RPC(route, data, options))

exports.ack = ack
exports.nack = nack
exports.replyMap = replyMap
exports.replyMergeMap = replyMergeMap
exports.replyTap = replyTap
exports.forward = forward
exports.wrapState = wrapState
exports.unwrapData = unwrapData
exports.unwrapState = unwrapState
exports.unwrap = unwrapMsg
exports.unwrapMsg = unwrapMsg
exports.mergeRPC = mergeRPC
exports.publish = publish
exports.publishMap = publishMap
exports.dedupeQueueTap = dedupeQueueTap
exports.dedupeQueueMap = dedupeQueueMap
exports.dedupeExchangeTap = dedupeExchangeTap
exports.dedupeExchangeMap = dedupeExchangeMap
