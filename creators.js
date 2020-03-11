const { Observable, of, isObservable } = require('rxjs')
const {
    filter,
    timeout,
    map,
    mergeMap,
    tap,
    finalize,
    share,
    catchError
} = require('rxjs/operators')
const uuidv1 = require('uuid/v1')

const { ch } = require('./amqp')
const {
    publishJSON,
    publishErrorResponse,
    publishResponse,
    ackMsg
} = require('./utils')
const routes = require('./routes')

const { REPLY_ROUTING_KEY, ERROR_ROUTING_KEY } = require('./constants')

const RPCReplies$ = routes[REPLY_ROUTING_KEY]({
    queueName: '',
    queue: { durable: false, autoDelete: true, arguments: { messageTtl: 3600000 } },
    consumer: { noAck: true }
})

const RPCErrors$ = routes[ERROR_ROUTING_KEY]({
    queueName: '',
    queue: { durable: false, autoDelete: true, arguments: { messageTtl: 3600000 } },
    consumer: { noAck: true }
})

RPCReplies$.subscribe()
RPCErrors$.subscribe()

const RPC = (route, data = {}, options = {}) => {
    const channel = options.channel || ch
    return new Observable(observer => {
        const correlationId = uuidv1()

        // timeout
        const timeoutTime = options.timeout || 99999999
        const subscription = RPCReplies$.pipe(
            tap(msg => msg.content),
            filter(msg => msg.properties.correlationId === correlationId),
            timeout(timeoutTime)
        ).subscribe({
            next(msg) {
                observer.next(msg)
                observer.complete(msg)
                subscription.unsubscribe()
            },
            error(error) {
                observer.error(error)
                subscription.unsubscribe()
            },
            complete() {
                subscription.unsubscribe()
            }
        })

        subscription.add(
            RPCErrors$.pipe(
                filter(msg => msg.properties.correlationId === correlationId)
            ).subscribe({
                next(msg) {
                    observer.error(msg.content)
                    subscription.unsubscribe()
                },
                error(error) {
                    observer.error(error)
                    subscription.unsubscribe()
                },
                complete() {
                    subscription.unsubscribe()
                }
            })
        )

        publishJSON(channel, options.exchange, route, data, {
            correlationId,
            headers: {
                'x-reply-route': REPLY_ROUTING_KEY,
                'x-error-route': ERROR_ROUTING_KEY
            }
        })
    })
}

const reply = (msg, callback, exchange, options) => {
    options = { noAck: true, ...options }
    return of(callback).pipe(
        map(cb => (typeof cb === 'function' ? cb.call(null, msg) : cb)),
        mergeMap(result => Promise.resolve(result)),
        mergeMap(result => (isObservable(result) ? result : of(result))),
        tap(result => publishResponse(ch, msg, options.routingKey, result, exchange)),
        catchError(error => {
            publishErrorResponse(ch, msg, options.errorRoutingKey, error, exchange)
            throw error
        }),
        finalize(() => {
            if (options.noAck) {
                ackMsg(msg)
            }
        }),
        share()
    )
}

exports.RPC = RPC
exports.reply = reply
