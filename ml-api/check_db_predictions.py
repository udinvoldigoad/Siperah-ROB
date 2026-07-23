import psycopg2

def check():
    conn = psycopg2.connect(
        host="127.0.0.1",
        database="siperah_rob",
        user="postgres",
        password="postgres",
        port="5432"
    )
    cur = conn.cursor()
    
    # Query max probability per regency for today (2026-07-23)
    cur.execute("""
        SELECT r.regency, MAX(p.risk_probability) as max_prob, MAX(p.risk_class) as max_class
        FROM predictions p 
        JOIN regions r ON p.region_id = r.id 
        WHERE p.prediction_date = '2026-07-23'
        GROUP BY r.regency
        ORDER BY max_prob DESC
    """)
    print("Regency max probability for today (2026-07-23):")
    for row in cur.fetchall():
        print(f" - {row[0]}: {row[1]}% (Class: {row[2]})")
        
    # Check predictions for Tulang Bawang for today (2026-07-23)
    cur.execute("""
        SELECT r.village, p.risk_probability, p.risk_class
        FROM predictions p 
        JOIN regions r ON p.region_id = r.id 
        WHERE r.regency = 'Tulang Bawang' AND p.prediction_date = '2026-07-23'
    """)
    print("\nTulang Bawang villages for today (2026-07-23):")
    for row in cur.fetchall():
        print(f" - {row[0]}: {row[1]}% (Class: {row[2]})")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check()
