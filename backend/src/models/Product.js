import mongoose from 'mongoose';
import crypto from 'crypto';
import slugify from 'slugify';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0 },
    images: [{ url: String, publicId: String }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    stock: { type: Number, default: 0, min: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// indexes used by list/search/sort queries
productSchema.index({ category: 1, price: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ name: 'text', description: 'text' });

productSchema.pre('validate', function () {
  if (this.isNew && !this.slug) {
    this.slug = `${slugify(this.name, { lower: true, strict: true })}-${crypto.randomBytes(3).toString('hex')}`;
  }
});

export default mongoose.model('Product', productSchema);