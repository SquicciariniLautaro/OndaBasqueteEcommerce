import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 1,
        max: 100 
    },
    isActive: {
        type: Boolean,
        default: true 
    },
    pointsRequired: {
        type: Number,
        default: 0 
    },
    // NUEVO: Array para recordar quiénes ya usaron este cupón
    usedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true 
});

export default mongoose.model("Coupon", couponSchema);