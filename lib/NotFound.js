class NotFound extends Error {
    constructor(message = 'not found'){
        super(message)
        this.code = '_notfound_'
    }
}
module.exports = NotFound