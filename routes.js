const { Observable, Subject } = require('rxjs')
const { tap, share } = require('rxjs/operators')

const { ch } = require('./amqp')

const { CONSUMER_EXCHANGE, QUEUE_PREFIX } = require('./constants')

const consumers = new Map()
function MQRoutesObservable(path = []) {
    if (typeof path === 'string') {
        path = path.split('.')
    }
    return new Proxy(
        function() {
            console.log('function')
        },
        {
            get(obj, prop, receiver) {
                if (prop === '__routingKey__') {
                    return path.join('.')
                } else {
                    return MQRoutesObservable([...path, prop])
                }
            },
            apply(target, that, [options = {}, ...args]) {
                options = Object.assign(
                    {
                        exchange: CONSUMER_EXCHANGE
                    },
                    options
                )
                const exchange = options.exchange
                const routingKey = path.join('.')

                let queueName = `${QUEUE_PREFIX}${routingKey}`
                if (options.queueName !== undefined) {
                    queueName = options.queueName
                }
                const consumerKey = JSON.stringify([
                    exchange,
                    queueName,
                    options.consumer
                ])
                const observable = new Observable(subscriber => {
                    ;(async () => {
                        let channel = ch
                        if (options.channel) {
                            channel = await options.channel
                        }
                        try {
                            let consumer$ = consumers.get(consumerKey)
                            if (consumer$) {
                                console.log(
                                    `Reusing #${routingKey} @${queueName} %${exchange}`
                                )
                            } else {
                                const q = await ch.assertQueue(
                                    queueName,
                                    options.queue || {}
                                )
                                const assignedQueueName = q.queue
                                await ch.bindQueue(
                                    assignedQueueName,
                                    exchange,
                                    routingKey
                                )

                                console.log(
                                    `#${routingKey} @${assignedQueueName} %${exchange} ${options.consumer}`
                                )

                                consumer$ = new Observable(subscriber => {
                                    let consumerResult = channel.consume(
                                        assignedQueueName,
                                        msg => subscriber.next(msg),
                                        options.consumer || {}
                                    )
                                    return async () => {
                                        const { consumerTag } = await consumerResult
                                        console.log(`CondumerTag: ${consumerTag} Down`)
                                        ch.cancel(consumerTag).catch(console.error)
                                        consumers.delete(consumerKey)
                                    }
                                }).pipe(
                                    tap(
                                        msg =>
                                            (msg.content = JSON.parse(
                                                msg.content.toString()
                                            ))
                                    ),
                                    tap(msg => (msg.channel = channel)),
                                    share()
                                )
                                consumers.set(consumerKey, consumer$)
                            }
                            consumer$.subscribe(subscriber)
                        } catch (error) {
                            subscriber.error(error)
                        }
                    })()
                    return () => {
                        console.log(`Unsubscribed from ${routingKey}`)
                        // if (consumerKey) ch.cancel(consumerTag)
                        // can't cancel consumer because we don't have the consumer key until we get a message, also it is cached now
                    }
                }).pipe(share())
                observable.__routingKey__ = routingKey
                return observable
            }
        }
    )
}

module.exports = MQRoutesObservable()
