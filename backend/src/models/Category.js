import mongoose from 'mongoose';
import slugify from 'slugify';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  },
  { timestamps: true }
);

categorySchema.pre('validate', function () {
  if (this.isModified('name')) this.slug = slugify(this.name, { lower: true, strict: true });
});

export default mongoose.model('Category', categorySchema);