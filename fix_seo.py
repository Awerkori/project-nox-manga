import re

with open('tests/seo.test.ts', 'r') as f:
    content = f.read()

content = content.replace("cover_id: null", "coverId: null")
content = content.replace("updated_at: ", "updatedAt: ")
content = content.replace("created_at: ", "createdAt: ")
content = content.replace("age_rating: ", "contentRating: ") # wait, is it contentRating or ageRating?
content = content.replace("cover_id: 'cover'", "coverId: 'cover'")

with open('tests/seo.test.ts', 'w') as f:
    f.write(content)
