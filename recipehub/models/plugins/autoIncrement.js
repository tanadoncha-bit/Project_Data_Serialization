const { Schema, model, models } = require('mongoose');

const Counter = models.Counter ||
  model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));

module.exports = function autoIncrement(schema, { name }) {
  schema.pre('save', async function () {
    if (!this.isNew || this._id != null) return;
    const c = await Counter.findByIdAndUpdate(
      name, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' }
    );
    this._id = c.seq;
  });
};