import re

def split_seed_file(input_file, output_file, batch_size=10):
    with open(input_file, 'r') as f:
        content = f.read()

    # Find the start of the values
    match = re.search(r'INSERT INTO recipes .*? VALUES\s*', content, re.DOTALL)
    if not match:
        print("Could not find INSERT statement")
        return

    header = match.group(0).strip()
    values_block = content[match.end():].strip()
    
    if values_block.endswith(';'):
        values_block = values_block[:-1]

    # Split by "),\n(" which seems to be the separator in the file, 
    # but we need to be careful about nested parenthesis in JSON. 
    # However, looking at the file, each tuple starts with (' and ends with ) or ),
    # Let's use a simpler approach: Split by `),\n` 
    
    # Actually, regex might be safer to split the tuples.
    # The file format is: ('Title', ...), \n ('Title', ...)
    
    # Let's try splitting by `),\n` which is the separator between rows in the provided file.
    rows = values_block.split('),\n')
    
    # Add back the closing parenthesis for all but the last one (which might have it)
    # and the opening parenthesis for all but the first one.
    
    cleaned_rows = []
    for i, row in enumerate(rows):
        r = row.strip()
        if i < len(rows) - 1:
            r += ")" # Add back the closing parenthesis removed by split
        
        # Remove the leading comma if it was left by a previous split iteration (not applicable here with this split method)
        # But we need to ensure it starts with (
        if not r.startswith('('):
             r = '(' + r # Should not happen with this split logic but good safety
             
        cleaned_rows.append(r)

    with open(output_file, 'w') as f:
        for i in range(0, len(cleaned_rows), batch_size):
            batch = cleaned_rows[i:i + batch_size]
            statement = header + "\n" + ",\n".join(batch) + ";\n\n"
            f.write(statement)

    print(f"Successfully split {len(cleaned_rows)} rows into batches of {batch_size}.")

if __name__ == "__main__":
    split_seed_file('backend/seed.sql', 'backend/seed_chunked.sql', batch_size=20)
