import mongoose from 'mongoose';

// One document per user. `progress` is the same shape the React app already uses.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    hash: { type: String, required: true },
    progress: {
      xp: { type: Number, default: 0 },
      streak: { type: Number, default: 1 },
      done: { type: [String], default: [] }, // finished lesson ids
      last: { type: String, default: () => new Date().toDateString() },
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
