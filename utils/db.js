import mysql from "mysql2"

// Create a MySQL connection pool
export const pool = mysql.createPool({
  connectionLimit: 10,
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
})

// Verify the connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database:", err)
    return
  }
  console.log("Database connected successfully")
  connection.release()
})
