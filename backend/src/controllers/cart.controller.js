import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { round2 } from '../utils/money.js';

const MAX_QTY = 20;

const checkId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id', 400);
};

const getOrCreate = (userId) =>
  Cart.findOneAndUpdate({ user: userId }, { $setOnInsert: { items: [] } }, { upsert: true, new: true });

async function sendCart(res, userId, status = 200) {
  const cart = await Cart.findOne({ user: userId })
    .populate('items.product', 'name slug price discountPrice images stock isActive')
    .lean();

  const items = (cart?.items || [])
    .filter((i) => i.product)
    .map((i) => {
      const unitPrice = i.product.discountPrice ?? i.product.price;
      return { product: i.product, quantity: i.quantity, unitPrice, lineTotal: round2(unitPrice * i.quantity) };
    });

  res.status(status).json({
    success: true,
    data: {
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: round2(items.reduce((n, i) => n + i.lineTotal, 0)),
    },
  });
}

export const getCart = asyncHandler(async (req, res) => sendCart(res, req.user._id));

export const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  checkId(productId);

  const product = await Product.findOne({ _id: productId, isActive: true }).select('stock').lean();
  if (!product) throw new AppError('Product not found', 404);

  const cart = await getOrCreate(req.user._id);
  const existing = cart.items.find((i) => String(i.product) === productId);
  const newQty = (existing?.quantity || 0) + quantity;

  if (newQty > MAX_QTY) throw new AppError(`Max ${MAX_QTY} units per product`, 400);
  if (newQty > product.stock) throw new AppError(`Only ${product.stock} in stock`, 409);

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: productId, quantity });
  await cart.save();

  await sendCart(res, req.user._id, 201);
});

export const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  checkId(productId);

  const product = await Product.findOne({ _id: productId, isActive: true }).select('stock').lean();
  if (!product) throw new AppError('Product not found', 404);
  if (quantity > product.stock) throw new AppError(`Only ${product.stock} in stock`, 409);

  const cart = await Cart.findOne({ user: req.user._id });
  const item = cart?.items.find((i) => String(i.product) === productId);
  if (!item) throw new AppError('Item not in cart', 404);

  item.quantity = quantity;
  await cart.save();
  await sendCart(res, req.user._id);
});

export const removeItem = asyncHandler(async (req, res) => {
  checkId(req.params.productId);
  await Cart.updateOne({ user: req.user._id }, { $pull: { items: { product: req.params.productId } } });
  await sendCart(res, req.user._id);
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  await sendCart(res, req.user._id);
});