// controllers/UserController.js

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import User from "../models/UserModel.js"; // Adjusted import

const SECRET_KEY =
  process.env.ACCESS_TOKEN_SECRET || "qwerttyuio12345asdfghjkl67890zxcvbnm";

export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

export const Register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res
        .status(404)
        .json({ msg: "Username sudah ada! Ganti username!" });
    }

    const salt = await bcrypt.genSalt();
    const hashPassword = await bcrypt.hash(password, salt);

    await User.create({
      username,
      email,
      password: hashPassword,
      role: "user",
    });

    res.json({ msg: "Register Berhasil" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

export const Login = async (req, res) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) {
      return res.status(400).json({ msg: "Wrong Password" });
    }

    const { id, name, username, email, phone, role, image, url } = user;

    const accessToken = jwt.sign(
      {
        userId: id,
        name,
        username,
        email,
        phone,
        role,
        image,
        url,
      },
      SECRET_KEY,
      {
        expiresIn: "1d",
      }
    );

    await User.update({ refresh_token: accessToken }, { where: { id } });

    res.json({ accessToken, role });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

export const Me = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "Unauthorized" });

    const decoded = jwt.verify(token, SECRET_KEY);

    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

export const Logout = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(204).json({ msg: "No token provided" });

    const user = await User.findOne({ where: { refresh_token: token } });

    if (!user) {
      return res
        .status(204)
        .json({ msg: "User not found or already logged out" });
    }

    await User.update({ refresh_token: null }, { where: { id: user.id } });

    res.status(200).json({ msg: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

export const updateUsersWithToken = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "Unauthorized" });

    const decoded = jwt.verify(token, SECRET_KEY);

    const user = await User.findByPk(decoded.userId);

    if (!user || user.refresh_token !== token) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    let fileName = user.image || "default.png";
    if (req.files && req.files.image) {
      const file = req.files.image;
      const fileSize = file.size;
      const ext = path.extname(file.name);
      fileName = file.md5 + ext;

      const allowedType = [".png", ".jpg", ".jpeg"];
      if (!allowedType.includes(ext.toLowerCase())) {
        return res.status(422).json({ msg: "Invalid image type" });
      }
      if (fileSize > 5000000) {
        return res.status(422).json({ msg: "Max image size is 5MB" });
      }

      file.mv(`./public/images/${fileName}`, (err) => {
        if (err) {
          console.error("Error moving file:", err.message);
          return res.status(500).json({ msg: err.message });
        }
      });
    }

    const { name, email, phone, alamat } = req.body;

    await User.update(
      {
        name: name || null,
        username: user.username || null,
        email: email || null,
        phone: phone || null,
        alamat: alamat || null,
        password: user.password || null,
        role: "user",
        image: fileName || "default.png",
        url: url || null,
      },
      { where: { id: user.id } }
    );

    res.status(200).json({ msg: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

export const updatepassword = async (req, res) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });

    const { password } = req.body;

    const salt = await bcrypt.genSalt();
    const hashPassword = await bcrypt.hash(password, salt);

    await User.update(
      { password: hashPassword || null },
      { where: { id: user.id } }
    );

    res.status(200).json({ msg: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "Unauthorized" });

    const decoded = jwt.verify(token, SECRET_KEY);

    const user = await User.findByPk(decoded.userId);

    if (!user || user.refresh_token !== token) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    if (user.image && user.image !== "default.png") {
      const filePath = `./public/images/${user.image}`;
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Failed to remove image:", err);
        }
      });
    }

    await User.destroy({ where: { id: user.id } });

    res.status(200).json({ msg: "User deleted successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};
