// server.js

import express from "express";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";

// Custom Errors
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
  }
}
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

const app = express();
const PORT = 3000;

// In-memory data store for products
const products = [];

// Middleware: Logger
function logger(req, res, next) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
}

// Middleware: Authentication
function authMiddleware(req, res, next) {
  const apiKey = req.header("x-api-key");
  if (!apiKey || apiKey !== "mysecretapikey") {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing API key" });
  }
  next();
}

// Middleware: Validation for product create/update
function validateProduct(req, res, next) {
  const { name, description, price, category, inStock } = req.body;
  if (
    typeof name !== "string" ||
    typeof description !== "string" ||
    typeof price !== "number" ||
    typeof category !== "string" ||
    typeof inStock !== "boolean"
  ) {
    return next(new ValidationError("Invalid product data"));
  }
  next();
}

// Middleware: Global error handler
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
}

// Middleware: Async wrapper to catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Parse JSON bodies
app.use(bodyParser.json());

// Use logger middleware globally
app.use(logger);

// Root route "Hello World"
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Below routes require authentication
app.use("/api/products", authMiddleware);

// RESTful API Routes

// GET /api/products - list with filtering, pagination
app.get(
  "/api/products",
  asyncHandler(async (req, res) => {
    let filtered = products;

    // Filter by category query param
    if (req.query.category) {
      filtered = filtered.filter(
        (p) => p.category.toLowerCase() === req.query.category.toLowerCase()
      );
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginated = filtered.slice(startIndex, endIndex);

    res.json({
      page,
      limit,
      total: filtered.length,
      data: paginated,
    });
  })
);

// GET /api/products/:id
app.get(
  "/api/products/:id",
  asyncHandler(async (req, res, next) => {
    const product = products.find((p) => p.id === req.params.id);
    if (!product) throw new NotFoundError("Product not found");
    res.json(product);
  })
);

// POST /api/products - create new product
app.post(
  "/api/products",
  validateProduct,
  asyncHandler(async (req, res) => {
    const { name, description, price, category, inStock } = req.body;
    const newProduct = {
      id: uuidv4(),
      name,
      description,
      price,
      category,
      inStock,
    };
    products.push(newProduct);
    res.status(201).json(newProduct);
  })
);

// PUT /api/products/:id - update product
app.put(
  "/api/products/:id",
  validateProduct,
  asyncHandler(async (req, res, next) => {
    const productIndex = products.findIndex((p) => p.id === req.params.id);
    if (productIndex === -1) throw new NotFoundError("Product not found");
    const { name, description, price, category, inStock } = req.body;
    products[productIndex] = {
      id: req.params.id,
      name,
      description,
      price,
      category,
      inStock,
    };
    res.json(products[productIndex]);
  })
);

// DELETE /api/products/:id
app.delete(
  "/api/products/:id",
  asyncHandler(async (req, res, next) => {
    const productIndex = products.findIndex((p) => p.id === req.params.id);
    if (productIndex === -1) throw new NotFoundError("Product not found");
    products.splice(productIndex, 1);
    res.status(204).send();
  })
);

// GET /api/products/search?name= - search by name substring
app.get(
  "/api/products/search",
  asyncHandler(async (req, res) => {
    const nameQuery = req.query.name;
    if (!nameQuery) {
      return res
        .status(400)
        .json({ error: "Missing required query parameter: name" });
    }
    const matched = products.filter((p) =>
      p.name.toLowerCase().includes(nameQuery.toLowerCase())
    );
    res.json(matched);
  })
);

// GET /api/products/stats - product count by category
app.get(
  "/api/products/stats",
  asyncHandler(async (req, res) => {
    const stats = products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {});
    res.json(stats);
  })
);

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
