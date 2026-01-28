const { Schema, model } = require("mongoose");

const settlementSchema = new Schema({
    userId: {
        type: String,
        required: true,
    },
    amountPaid: {
        type: Number,
        required: true,
    },
    datePaid: {
        type: Date,
        default: Date.now,
    },
});

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
    settlements: {
        type: [settlementSchema],
        default: [],
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

// Virtual property to check if a specific participant has fully settled
expenseSchema.methods.isSettledBy = function (userId) {
    if (userId === this.paidBy) return true; // Payer doesn't owe themselves

    const splitAmount = this.amount / this.participants.length;
    const userSettlements = this.settlements.filter((s) => s.userId === userId);
    const totalPaid = userSettlements.reduce((sum, s) => sum + s.amountPaid, 0);

    return totalPaid >= splitAmount;
};

// Virtual property to check if expense is fully settled by all participants
expenseSchema.virtual("isFullySettled").get(function () {
    const owingParticipants = this.participants.filter(
        (p) => p !== this.paidBy,
    );
    return owingParticipants.every((p) => this.isSettledBy(p));
});

// Method to get remaining amount owed by a specific participant
expenseSchema.methods.getRemainingAmount = function (userId) {
    if (userId === this.paidBy) return 0;

    const splitAmount = this.amount / this.participants.length;
    const userSettlements = this.settlements.filter((s) => s.userId === userId);
    const totalPaid = userSettlements.reduce((sum, s) => sum + s.amountPaid, 0);

    return Math.max(0, splitAmount - totalPaid);
};

module.exports = model("Expense", expenseSchema);
