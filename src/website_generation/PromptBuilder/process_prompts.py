import pandas as pd
import os

def read_prompt_template():
    with open('prompt_template.txt', 'r') as file:
        return file.read()

def process_prompt(template, industry, website):
    # Replace variables in the template
    processed_prompt = template.replace('{{INDUSTRY}}', industry)
    processed_prompt = processed_prompt.replace('{{SITE_URL}}', website)
    # Ensure the prompt is properly escaped for CSV
    return processed_prompt.replace('\n', '\\n')

def main():
    # Read the prompt template
    template = read_prompt_template()
    
    # Get the input file from command line arguments
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 process_prompts.py <input_csv_file>")
        return
    
    input_file = sys.argv[1]
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Please ensure the file exists in the current directory.")
        return
    
    df = pd.read_csv(input_file)
    
    # Process each row and add the processed prompt
    df['processed_prompt'] = df.apply(
        lambda row: process_prompt(template, row['Industry'], row['Website']), 
        axis=1
    )
    
    # Save back to the original CSV file
    df.to_csv(input_file, index=False, escapechar='\\')
    print(f"Updated prompts added to {input_file}")

if __name__ == "__main__":
    main() 