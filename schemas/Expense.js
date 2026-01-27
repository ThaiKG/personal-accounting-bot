const { Schema, model } = require("mongoose");

const expenseSchema = new Schema({
    paidBy: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: false,
    },
    participants: {
        type: [String],
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    settled: {
        type: Boolean,
        default: false,
    },
});

module.exports = model("Expense", expenseSchema);
